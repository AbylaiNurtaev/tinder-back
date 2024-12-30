import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true    
    },
    password: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    birthday: String,
    gender: String,
    height: String,
    height: Number,
    Location: String,
    wantToFind: String,
    goal: String,
    photo1: String,
    photo2: String,
    photo3: String,
    about: String,
    role: {
        type: String,
        default: "user"
    },
    telegramId: String
}, {
    timestamps: true,
});

export default mongoose.model('User', UserSchema);