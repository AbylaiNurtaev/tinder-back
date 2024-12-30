import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    birthDay: String,
    birthMonth: String,
    birthYear: String,
    gender: String,
    height: String,
    height: Number,
    location: String,
    wantToFind: String,
    goal: String,
    photo1: String,
    photo2: String,
    photo3: String,
    about: {
        type: String,
        default: ""
    },

    role: {
        type: String,
        default: "user"
    },
    photos: {
        type: [String],
        default: []
    },
    telegramId: { type: Number, unique: true, required: true }
}, {
    timestamps: true,
});

export default mongoose.model('User', UserSchema);