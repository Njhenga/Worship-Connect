import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import mongoose from "mongoose";
import dotenv from "dotenv";
// needed for sockets
import http from "http";
//real-time updates
import { Server } from "socket.io";

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(bodyParser.urlencoded({extended:true}));
//servings the assets in the public folder
app.use(express.static("public"));

//songs and lyricd schema defined
const songSchema = new mongoose.Schema({
  title: { type: String, required: true },
  lyrics: { type: String, required: true }, // all lyrics as one string
  createdAt: { type: Date, default: Date.now }
});

 const Song = mongoose.model("Song", songSchema, "Songs" );

//annoucements schema defined
const announcementSchema = new 
mongoose.Schema({
    text: String,
    createdAt : {type: Date, default: Date.now}
})

const Announcement = mongoose.model("Announcement", announcementSchema, "Announcements")

//Songs and Lyrics Page
// Save a new song with all lyrics
app.post("/api/song", async (req, res) => {
  const { title, lyrics } = req.body;

  if (!title || !lyrics) {
    return res.status(400).json({ error: "Title and lyrics are required" });
  }

  try {
    const newSong = new Song({ title, lyrics });
    await newSong.save();
    res.json({ success: true, message: "Song saved successfully" });
  } catch (err) {
    console.error("Error saving song:", err);
    res.status(500).json({ error: "Failed to save song" });
  }
});
// Get a song by title
app.get("/api/song/:title", async (req, res) => {
  const { title } = req.params;

  try {
    const song = await Song.findOne({ title });
    if (!song) {
      return res.status(404).json({ error: "Song not found" });
    }

    res.json({ title: song.title, lyrics: song.lyrics });
  } catch (err) {
    console.error("Error fetching song:", err);
    res.status(500).json({ error: "Failed to fetch song" });
  }
});
//Socket connection
io.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("songLive", (data) => {
    // data: { title, line }
    io.emit("displaySong", data); // send to all connected output pages
  });

  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});


//HOME PAGE
// getting the log in page
app.get("/", (req, res)=> {
    res.sendFile("/public/index.html")
} );

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    // Hardcoded test user (for now)
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (email === adminEmail && password === adminPassword) {
        res.redirect("/admin.html");
    } else {
        res.send("Wrong credentials");
    }
});

//Announcements page

//server sending annucements to output
io.on("connection", (socket) => {
  console.log("A client connected");

  // Admin sends announcement here
  socket.on("announcementLive", (announcement) => {
    console.log("Announcement received from admin:", announcement);

    // 👇 THIS LINE SENDS IT TO OUTPUT SCREENS
    io.emit("announcementUpdate", announcement);
  });
});

// Get all announcements
app.get("/api/announcements", async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 }); // latest first
    res.json(announcements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single announcement by ID
app.get("/api/announcements/:id", async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }
    res.json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all announcements
app.get("/api/announcements", async (req, res) => {
  try {
    const announcements = await Announcement.find({}); // fetch all saved announcements from MongoDB
    res.json(announcements); // return as an array
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

//saving all announcements
app.post("/announcementText", async (req, res) => {
  const announcement = req.body.announcementText; // now matches admin textarea

  console.log("Received from JS: " + announcement);

  if (!announcement || !announcement.trim()) {
    return res.status(400).json({ message: "Announcement cannot be empty" });
  }

  try {
    const newAnnouncement = new Announcement({ text: announcement });
    await newAnnouncement.save();
    res.status(201).json({ message: "Announcement saved!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//Bible Verses Section
// GET Bible verses
app.get("/api/bible", async (req, res) => {
  const { query } = req.query; // the full input string from admin
  if (!query) return res.status(400).json({ error: "No verse provided" });

  try {
    //const axios = require("axios");

    // Example query: "John 3:16" or "Ephesians 4:1-6"
    const match = query.match(/^([1-3]?\s?\w+)\s+(\d+):(\d+)(-(\d+))?$/i);

    if (!match) {
      return res.status(400).json({ error: "Invalid verse format" });
    }

    const book = match[1].trim();
    const chapter = match[2];
    const start = parseInt(match[3]);
    const end = match[5] ? parseInt(match[5]) : start;

    let verses = [];

    // Loop through all verses in the range
    for (let v = start; v <= end; v++) {
      const ref = `${book} ${chapter}:${v}`;
      const response = await axios.get(
        `https://bible-api.com/${encodeURIComponent(ref)}?translation=kjv`
      );

      verses.push({
        reference: ref,
        text: response.data.text.trim()
      });
    }

    res.json(verses);

  } catch (err) {
    console.error("Bible API error:", err.message);
    res.status(500).json({ error: "Failed to fetch verses" });
  }
});

io.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("bibleLive", (data) => {
    io.emit("displayBible", data); // send to all connected output pages
  });

  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});


//server
server.listen(port, () => {
    console.log(`server is running on port ${port}`)
});




