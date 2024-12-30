import express from 'express';
import mongoose from 'mongoose';
import chalk from 'chalk';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';
import crypto from 'crypto';

import * as UserController from './controllers/UserController.js';

dotenv.config();

const errorMsg = chalk.bgWhite.redBright;
const successMsg = chalk.bgGreen.white;

// Подключение к базе данных
mongoose.connect('mongodb+srv://abeke:20060903@cluster0.vm8hy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log(successMsg("DB ok")))
  .catch((err) => console.log(errorMsg("DB error:", err)));

// Настройка Express
const app = express();

app.use(cors({
  origin: '*', // Укажите домен вашего фронтенда
  methods: ['GET', 'PATCH', 'POST', 'PUT', 'DELETE'],
  credentials: true, // Если нужны куки или авторизация
}));

app.use(express.json());

// Настройка Multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Функция для валидации initData и извлечения ID
function extractUserId(initData, botToken) {
  try {
    // Генерация секретного ключа для HMAC
    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    // Разбор параметров initData
    const urlParams = new URLSearchParams(initData);
    const signature = urlParams.get('signature');
    urlParams.delete('signature'); // Убираем подпись для проверки

    // Формируем строку для проверки подписи
    const checkString = [...urlParams.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    // Проверяем подпись

    // Извлекаем параметр user
    const userParam = urlParams.get('user');
    if (!userParam) {
      throw new Error('Параметр user отсутствует!');
    }

    // Разбираем JSON и извлекаем userId
    const user = JSON.parse(userParam);
    console.log(user.id);
    
    return user.id || null;
  } catch (error) {
    console.error('Ошибка при обработке данных:', error);
    return null;
  }
}

// Middleware для проверки initData
function validateInitData(req, res, next) {
  const initData = req.body.initData; // Предполагается, что данные приходят в теле запроса
  const botToken = '7907947665:AAHIf4kb_zghTa8q0q1_06Hp2GFR11eqq_E'; // Укажите токен вашего бота

  if (!initData || !botToken) {
    return res.status(400).json({ error: 'initData или токен не предоставлены' });
  }

  const userId = extractUserId(initData, botToken);

  if (!userId) {
    return res.status(403).json({ error: 'Недействительные данные initData' });
  }

  req.userId = userId; // Сохраняем ID пользователя в запросе
  next();
}

// Маршруты пользователей
app.post('/register', UserController.register);
app.post('/login', UserController.login);
app.post('/api/user/upload-photo', upload.single('photo'), UserController.uploadPhoto);

// Новый маршрут для валидации initData
app.post('/api/validate-init-data', validateInitData, (req, res) => {
  res.json({ userId: req.userId });
});

// Запуск сервера
const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(successMsg("Listening on port:", port));
});
