import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import User from '../models/User.js'; // Убедитесь, что путь правильный
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mongoose from 'mongoose';
import sharp from 'sharp'
import dotenv from 'dotenv';
dotenv.config();

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});


export const register = async (req, res) => {
  try {
    const newUser = new User({
      name: req.body.name,
      birthDay: req.body.birthDay,
      birthMonth: req.body.birthMonth,
      birthYear: req.body.birthYear,
      gender: req.body.gender,
      height: req.body.height,
      location: req.body.location,
      wantToFind: req.body.wantToFind,
      goal: req.body.goal,
      telegramId: req.body.telegramId,
      city: req.body.city
    });

    // Сохранение пользователя в базе данных
    const savedUser = await newUser.save();

    // Генерация токена
    const token = jwt.sign({ _id: savedUser._id }, 'secret123', { expiresIn: '30d' });

    // Ответ клиенту
    res.json({ token, ...savedUser._doc });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Не удалось зарегистрироваться' });
  }
};


export const login = async (req, res) => {
    try {
      // Поиск пользователя по email
      const user = await User.findOne({ email: req.body.email });
  
      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }
  
      // Проверка пароля
      const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
  
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Неверный логин или пароль' });
      }
  
      // Генерация JWT
      const token = jwt.sign({ _id: user._id }, 'secret123', { expiresIn: '30d' });
  
      // Возвращаем данные пользователя без пароля
      const { password, ...userData } = user._doc;
      res.json({ token, ...userData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Не удалось войти в аккаунт' });
    }
  };



  export const updateUserInfo = async (req, res) => {
    try {
      const userId = req.params.id;
  
      // Получаем текущего пользователя
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }
  
      // Формируем данные для обновления или добавления
      const updateData = {};
      const updatableFields = ['name', 'gender', 'photo1', 'photo2', 'photo3', 'height', 'goal', 'location', 'about', 'city', 'birthDay', 'birthMonth', 'birthYear'];
  
      updatableFields.forEach((field) => {
        // Если параметр передан, обновляем его
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
        // Если параметр не передан и его нет в документе, добавляем с пустым значением
        else if (user[field] === undefined) {
          updateData[field] = ''; // Или любое значение по умолчанию
        }
      });
  
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData, // Обновляем/добавляем данные
        { new: true } // Возвращаем обновленный объект
      );
  
      res.json({ message: 'Информация обновлена', user: updatedUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Не удалось обновить информацию' });
    }
  };
  
  
export const uploadPhoto = async (req, res) => {
  const { userId } = req.query;
  const index = parseInt(req.query.index, 10); // Determine which photo field to update

  if (!mongoose.Types.ObjectId.isValid(userId) || isNaN(index) || index < 0 || index > 2) {
    return res.status(400).json({ error: 'Некорректные параметры' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Upload file to S3
    const buffer = await sharp(req.file.buffer).toBuffer();
    const imageName = `${userId}_${Date.now()}_${index}`;

    const params = {
      Bucket: bucketName,
      Key: imageName,
      Body: buffer,
      ContentType: req.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3.send(command);

    // Update the user's photo field
    const photoField = `photo${index + 1}`; // photo1, photo2, photo3
    user[photoField] = imageName;
    await user.save();

    res.json({ message: 'Фото успешно загружено', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при загрузке фото' });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.body.userId });
    

    if (!user) {
      return res.json({ message: "Пользователь не найден" });
    }

    // Генерация ссылок для каждого изображения в портфолио
    const portfolioUrls = await Promise.all(
      [user?.photo1, user?.photo2, user?.photo3]
        .filter((key) => !!key) // Фильтруем только не null/undefined значения
        .map(async (key) => {
          const getObjectParams = {
            Bucket: bucketName,
            Key: key,
          };
          const command = new GetObjectCommand(getObjectParams);
          const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // Можно сделать ссылки постоянными
          return url;
        })
    );

    user.photos = portfolioUrls;
    console.log(portfolioUrls);

    const token = jwt.sign(
      {
        _id: user._id,
      },
      'secret123',
      {
        expiresIn: "30d",
      }
    );

    const { ...userData } = user._doc;
    res.json({
      ...userData,
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Ошибка при получении данных пользователя",
    });
  }
};



export const getTopUsers = async (req, res) => {
  try {
      const { userId } = req.body; // ID текущего пользователя

      // Получаем всех пользователей, исключая текущего пользователя
      const users = await User.find(userId ? { _id: { $ne: userId } } : {});

      if (users.length === 0) {
          return res.json([]);
      }

      // Вычисляем рейтинг (лайки + дизлайки) / просмотры
      const usersWithEngagement = users.map(user => ({
          ...user._doc,
          engagement: (user.likesReceived + user.dislikesReceived) / (user.profileViews || 1),
      }));

      // Сортируем по engagement (топовые пользователи наверху)
      usersWithEngagement.sort((a, b) => b.engagement - a.engagement);

      // Определяем границы топ-3% и топ-10%
      const top3PercentIndex = Math.ceil(usersWithEngagement.length * 0.03);
      const top10PercentIndex = Math.ceil(usersWithEngagement.length * 0.1);

      const top3PercentUsers = usersWithEngagement.slice(0, top3PercentIndex);
      const top10PercentUsers = usersWithEngagement.slice(top3PercentIndex, top10PercentIndex);
      const otherUsers = usersWithEngagement.slice(top10PercentIndex);

      // Объединяем пользователей с приоритетом (топ-3% → топ-10% → остальные)
      const finalUserList = [...top3PercentUsers, ...top10PercentUsers, ...otherUsers];

      // Генерация ссылок для изображений пользователей
      const ratedUsers = await Promise.all(
          finalUserList.map(async (user) => {
              const portfolioUrls = await Promise.all(
                  [user?.photo1, user?.photo2, user?.photo3]
                      .filter((key) => !!key)
                      .map(async (key) => {
                          const getObjectParams = {
                              Bucket: bucketName,
                              Key: key,
                          };
                          const command = new GetObjectCommand(getObjectParams);
                          const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
                          return url;
                      })
              );

              return { ...user, photos: portfolioUrls };
          })
      );

      res.json(ratedUsers);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Ошибка при получении пользователей' });
  }
};

export const getTelegramId = async (req, res) => {
  const initData = req.body.initData;
  console.log(req.body.initData)

  try {
    let existingUser = await User.findOne({ telegramId: initData });

    if (existingUser) {
      return res.json({ status: 'Пользователь с таким Telegram ID уже существует.', user: existingUser });
    }

    // Создаем нового пользователя, если не найден
    const newUser = new User({
      telegramId: initData
    });

    await newUser.save();

    return res.json({ 
      status: 'Новый пользователь создан.', 
      user: newUser, 
      telegramId: newUser.telegramId 
    });

  } catch (error) {
    console.error('Ошибка при обработке данных:', error);
    return res.status(500).json({ error: 'Ошибка при обработке initData.' });
  }
};



export const reactToUser = async (req, res) => {
  try {
    const { userId, targetUserId, action } = req.body;

    if (!userId || !targetUserId || !['like', 'dislike'].includes(action)) {
      return res.status(400).json({ message: 'Некорректные данные' });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (action === 'like') {
      if (!user.likes.includes(targetUserId)) {
          user.likes.push(targetUserId);
          user.likesGiven += 1;
          targetUser.likesReceived += 1;
      }
  } else {
      if (!user.dislikes.includes(targetUserId)) {
          user.dislikes.push(targetUserId);
          user.dislikesGiven += 1;
          targetUser.dislikesReceived += 1;
      }
  }
  

    await user.save();

    res.json({ message: `Вы ${action === 'like' ? 'лайкнули' : 'дизлайкнули'} пользователя`, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};


// Multer Middleware Setup
// const upload = multer({ storage: multer.memoryStorage() });