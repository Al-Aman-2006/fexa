const mongoose = require("mongoose")

const connectDB= async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("mongoDB connected successfully");

        const seedAdmin = require("./seedAdmin");
        await seedAdmin();
    } catch(error){
        console.error("mongoDB connection failed",error.message)
        process.exit(1)
    }
    
}
module.exports = connectDB