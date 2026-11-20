const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, ".env") });

const fictionalUsers = [
    {
        username: "aanya",
        firstName: "Aanya",
        lastName: "Sharma",
        age: 27,
        gender: "Woman",
        heightCm: 162,
        bio: "Curious, thoughtful, and happiest over a good book or a long walk.",
        education: "Master's in Design",
        profession: "Product Designer",
        interests: ["Reading", "Art", "Travel"],
        lifestyle: { routine: "A balanced weekday routine with time for friends and fitness.", interests: ["Walking", "Cooking"] },
        family: { background: "Close-knit family that values kindness and learning.", involvement: "Family is an important part of major decisions." }
    },
    {
        username: "rohan",
        firstName: "Rohan",
        lastName: "Verma",
        age: 29,
        gender: "Man",
        heightCm: 178,
        bio: "Easygoing, optimistic, and always looking for a new trail to explore.",
        education: "Bachelor's in Engineering",
        profession: "Software Engineer",
        interests: ["Hiking", "Music", "Cooking"],
        lifestyle: { routine: "Active mornings and relaxed weekends.", interests: ["Cycling", "Live music"] },
        family: { background: "Supportive family with a warm, practical outlook.", involvement: "Enjoys spending time with family." }
    },
    {
        username: "karthik",
        firstName: "Karthik",
        lastName: "Reddy",
        age: 28,
        gender: "Man",
        heightCm: 175,
        bio: "A patient listener who enjoys solving problems and discovering new cafes.",
        education: "Master's in Business",
        profession: "Business Analyst",
        interests: ["Coffee", "Photography", "Cricket"],
        lifestyle: { routine: "Mostly regular weekdays and social weekends.", interests: ["Photography", "Sports"] },
        family: { background: "Friendly family that enjoys shared meals.", involvement: "Values mutual respect and independence." }
    },
    {
        username: "arjun",
        firstName: "Arjun",
        lastName: "Mehta",
        age: 30,
        gender: "Man",
        heightCm: 181,
        bio: "Creative at heart, grounded by family, and fond of the outdoors.",
        education: "Bachelor's in Architecture",
        profession: "Architect",
        interests: ["Architecture", "Travel", "Gardening"],
        lifestyle: { routine: "A creative workday with outdoor time when possible.", interests: ["Gardening", "Walking"] },
        family: { background: "A close family with a mix of traditions and modern ideas.", involvement: "Family conversations are valued." }
    },
    {
        username: "varun",
        firstName: "Varun",
        lastName: "Kapoor",
        age: 29,
        gender: "Man",
        heightCm: 176,
        bio: "Warm, dependable, and happiest when sharing a home-cooked meal.",
        education: "Bachelor's in Finance",
        profession: "Financial Analyst",
        interests: ["Cooking", "Films", "Running"],
        lifestyle: { routine: "Likes a steady routine and an active start to the day.", interests: ["Running", "Movies"] },
        family: { background: "Supportive family with a strong sense of togetherness.", involvement: "Keeps family connected through regular visits." }
    },
    {
        username: "siddharth",
        firstName: "Siddharth",
        lastName: "Malhotra",
        age: 31,
        gender: "Man",
        heightCm: 180,
        bio: "Thoughtful and curious, with a soft spot for history and good conversation.",
        education: "Master's in History",
        profession: "Researcher",
        interests: ["History", "Museums", "Board games"],
        lifestyle: { routine: "Quiet weekdays balanced by cultural outings.", interests: ["Museums", "Board games"] },
        family: { background: "A kind family that encourages curiosity.", involvement: "Makes time for family gatherings." }
    },
    {
        username: "aditya",
        firstName: "Aditya",
        lastName: "Nair",
        age: 28,
        gender: "Man",
        heightCm: 174,
        bio: "Cheerful, open-minded, and enthusiastic about learning new things.",
        education: "Bachelor's in Communications",
        profession: "Marketing Strategist",
        interests: ["Writing", "Food", "Travel"],
        lifestyle: { routine: "Flexible schedule with time for creative projects.", interests: ["Writing", "Trying new food"] },
        family: { background: "A welcoming family that enjoys celebrating together.", involvement: "Family input is appreciated." }
    },
    {
        username: "sai-kiran",
        firstName: "Sai",
        lastName: "Kiran",
        age: 30,
        gender: "Man",
        heightCm: 177,
        bio: "Calm and considerate, with a love for music and weekend road trips.",
        education: "Master's in Computer Science",
        profession: "Data Scientist",
        interests: ["Music", "Road trips", "Fitness"],
        lifestyle: { routine: "Structured workdays and spontaneous weekend plans.", interests: ["Fitness", "Music"] },
        family: { background: "A close and encouraging family.", involvement: "Enjoys staying involved in family life." }
    },
    {
        username: "nikhil",
        firstName: "Nikhil",
        lastName: "Joshi",
        age: 29,
        gender: "Man",
        heightCm: 179,
        bio: "Friendly, sincere, and always up for a thoughtful conversation.",
        education: "Bachelor's in Environmental Science",
        profession: "Environmental Consultant",
        interests: ["Nature", "Reading", "Volunteering"],
        lifestyle: { routine: "Enjoys time outdoors and community activities.", interests: ["Hiking", "Volunteering"] },
        family: { background: "A supportive family that values compassion.", involvement: "Family relationships are a priority." }
    }
];

async function devStart() {
    console.log("-----------------------------------------");
    console.log("Starting Sambandh Setu Local Backend...");
    console.log("-----------------------------------------");

    const mongod = await MongoMemoryServer.create({
        instance: {
            port: 27017,
            dbName: "sambandh_setu"
        }
    });

    const mongoUri = mongod.getUri();
    console.log(`[Database] MongoDB local instance ready at ${mongoUri}`);
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/sambandh_setu";

    // Start Express Server
    const { startServer } = require("./server");
    const server = await startServer();

    // Check if we need to seed
    const User = require("./models/User");
    const Profile = require("./models/Profile");
    const Connection = require("./models/Connection");
    const ConnectionRequest = require("./models/ConnectionRequest");
    const Chat = require("./models/Chat");
    const Message = require("./models/Message");
    const seedB2 = require("./seed/seedB2");

    console.log("[Seed] Syncing all 9 users and profiles...");
    for (const fixture of fictionalUsers) {
        let user = await User.findOne({ username: fixture.username }).select("+passwordHash +isSeeded");
        if (!user) {
            user = new User({
                username: fixture.username,
                email: `${fixture.username}@example.test`,
                firstName: fixture.firstName,
                lastName: fixture.lastName,
                isSeeded: true
            });
            await user.setPassword("Password123!");
        } else {
            user.firstName = fixture.firstName;
            user.lastName = fixture.lastName;
            user.isSeeded = true;
            await user.setPassword("Password123!");
        }
        await user.save();

        const { username, firstName, lastName, ...profile } = fixture;
        await Profile.findOneAndUpdate(
            { user: user._id },
            { $set: { user: user._id, ...profile } },
            { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
        );
    }
    await seedB2();

    // Ensure Aanya and Rohan have an active Connection and Chat
    const aanya = await User.findOne({ username: "aanya" });
    const rohan = await User.findOne({ username: "rohan" });
    const karthik = await User.findOne({ username: "karthik" });

    if (aanya && rohan) {
        const pairKey = [String(aanya._id), String(rohan._id)].sort().join(":");
        let connReq = await ConnectionRequest.findOne({ pairKey });
        if (!connReq) {
            connReq = await ConnectionRequest.create({
                sender: aanya._id,
                recipient: rohan._id,
                pairKey,
                status: "accepted"
            });
        }

        let connection = await Connection.findOne({ pairKey });
        if (!connection) {
            connection = await Connection.create({
                participants: [aanya._id, rohan._id],
                pairKey,
                request: connReq._id,
                status: "active",
                stage: "understand"
            });
            console.log("[Seed] Created active Connection between Aanya and Rohan at stage 'understand'!");
        }

        let chat = await Chat.findOne({ connection: connection._id });
        if (!chat) {
            chat = await Chat.create({
                connection: connection._id,
                participants: [aanya._id, rohan._id],
                lastMessageAt: new Date()
            });
            await Message.create({
                chat: chat._id,
                sender: rohan._id,
                text: "Hi Aanya! Nice to connect with you. How is your week going?",
                readBy: [rohan._id]
            });
            console.log("[Seed] Created active Chat thread with initial message!");
        }
    }

    // Ensure a pending received request exists for Aanya from Karthik
    if (aanya && karthik) {
        const karthikPairKey = [String(karthik._id), String(aanya._id)].sort().join(":");
        const karthikReq = await ConnectionRequest.findOne({ pairKey: karthikPairKey });
        if (!karthikReq) {
            await ConnectionRequest.create({
                sender: karthik._id,
                recipient: aanya._id,
                pairKey: karthikPairKey,
                status: "pending"
            });
            console.log("[Seed] Created pending interest request from Karthik to Aanya!");
        }
    }

    console.log("=========================================");
    console.log(`Sambandh Setu Backend running at: http://localhost:${process.env.PORT || 5000}`);
    console.log(`Health check: http://localhost:${process.env.PORT || 5000}/health`);
    console.log("=========================================");

    const shutdown = async (signal) => {
        console.log(`Received ${signal}, shutting down gracefully...`);
        server.close(async () => {
            try {
                await mongoose.disconnect();
                await mongod.stop();
                console.log("Backend and MongoDB stopped successfully.");
                process.exit(0);
            } catch (err) {
                console.error("Shutdown error:", err);
                process.exit(1);
            }
        });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

devStart().catch((err) => {
    console.error("Failed to start local dev backend:", err);
    process.exit(1);
});
