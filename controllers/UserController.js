import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import User from '../models/User.js'; // Убедитесь, что путь правильный
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
    // Хэширование пароля
    const salt = await bcrypt.genSalt(10); // Генерация соли
    const hashedPassword = await bcrypt.hash(req.body.password, salt); // Хэширование пароля

    // Создание нового пользователя
    const newUser = new User({
      email: req.body.email,
      name: req.body.name,
      password: hashedPassword, // Используем хэшированный пароль
      role: req.body.role
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



// export const updateUserInfo = async (req, res) => {
//   try {
//     const userId = req.params.id; 
//     const { city, country, job, oblast } = req.body;

//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { city, country, job, oblast }, // Обновляемые поля
//       { new: true } // Возвращаем обновленный объект
//     );

//     if (!updatedUser) {
//       return res.status(404).json({ message: 'Пользователь не найден' });
//     }

//     res.json({ message: 'Информация обновлена', user: updatedUser });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Не удалось обновить информацию' });
//   }
// };

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

// Multer Middleware Setup
// const upload = multer({ storage: multer.memoryStorage() });