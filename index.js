import express from 'express';
import mongoose from 'mongoose';
import chalk from 'chalk';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import * as UserController from './controllers/UserController.js';
import * as ChatController from './controllers/ChatController.js';
import User from './models/User.js';

dotenv.config();

const errorMsg = chalk.bgWhite.redBright;
const successMsg = chalk.bgGreen.white;

// Подключение к базе данных
mongoose.connect('mongodb+srv://abeke:20060903@cluster0.vm8hy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log(successMsg("DB ok")))
  .catch((err) => console.log(errorMsg("DB error:", err)));

const app = express();
const server = createServer(app); // Создаем HTTP-сервер
const io = new Server(server, { cors: { origin: "*" } }); // WebSocket сервер

app.use(cors({ origin: '*', methods: ['GET', 'PATCH', 'POST', 'PUT', 'DELETE'], credentials: true }));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

// 📌 Добавляем маршруты API
app.post('/register', UserController.register);
app.post('/login', UserController.login);
app.post('/updateUserInfo/:id', UserController.updateUserInfo);
app.post('/auth/getUserById', UserController.getUserById);
app.post('/users/getCandidates', UserController.getTopUsers);
app.post('/users/react', UserController.reactToUser);

app.post('/getMessages', ChatController.getMessages);

app.post('/getTelegramId', UserController.getTelegramId)

// 📌 WebSocket логика
const users = {}; // Связь userId -> socketId

io.on("connection", (socket) => {
    console.log(`Пользователь подключен: ${socket.id}`);

    socket.on("joinChat", (userId) => {
        users[userId] = socket.id;
        console.log(`Пользователь ${userId} вошел в чат`);
    });

    socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
        const receiverSocketId = users[receiverId];

        // Сохранение в базу данных
        const savedMessage = await ChatController.saveMessage(senderId, receiverId, message);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receiveMessage", savedMessage);
        }
    });

    socket.on("disconnect", () => {
        console.log(`Пользователь ${socket.id} отключился`);
        for (let userId in users) {
            if (users[userId] === socket.id) {
                delete users[userId];
                break;
            }
        }
    });
});

// Запуск сервера
const port = process.env.PORT || 3001;
server.listen(port, () => console.log(successMsg(`Listening on port: ${port}`)));
