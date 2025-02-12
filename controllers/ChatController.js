import Chat from '../models/Chat.js';
import mongoose from "mongoose";

export const saveMessage = async (senderId, receiverId, message) => {
    try {
        const newMessage = new Chat({ senderId, receiverId, message });
        await newMessage.save();
        return newMessage;
    } catch (err) {
        console.error("Ошибка при сохранении сообщения:", err);
        return null;
    }
};


export const getMessages = async (req, res) => {
    try {
        const { userId, receiverId } = req.body;

        if (!userId || !receiverId) {
            return res.status(400).json({ message: "Не указан userId или receiverId" });
        }

        console.log("Полученный userId:", userId);
        console.log("Полученный receiverId:", receiverId);

        const messages = await Chat.find({
            $or: [
                { senderId: userId, receiverId: receiverId },
                { senderId: receiverId, receiverId: userId }
            ]
        }).sort({ createdAt: 1 });

        console.log("Найденные сообщения:", messages);

        res.json(messages);
    } catch (err) {
        console.error("Ошибка при получении сообщений:", err);
        res.status(500).json({ message: "Ошибка при загрузке чата" });
    }
};

