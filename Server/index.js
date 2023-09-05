const express = require("express");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

const calendar = google.calendar("v3");
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

const counselorEmails = {
  counselor1: process.env.COUNSELOR1_EMAIL,
  counselor2: process.env.COUNSELOR2_EMAIL,
  counselor3: process.env.COUNSELOR3_EMAIL,
  counselor4: process.env.COUNSELOR4_EMAIL,
  counselor5: process.env.COUNSELOR5_EMAIL,
};


const counselors = [
  "counselor1",
  "counselor2",
  "counselor3",
  "counselor4",
  "counselor5",
].reduce((acc, counselor) => {
  acc[counselor] = {
    oauth2Client: new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URL
    ),
    refresh_token: process.env[`${counselor.toUpperCase()}_REFRESH_TOKEN`],
  };
  acc[counselor].oauth2Client.setCredentials({
    refresh_token: acc[counselor].refresh_token,
  });
  return acc;
}, {});

const counselorCalendarIDs = {
  counselor1: process.env.COUNSELOR1_CALENDAR_ID,
  counselor2: process.env.COUNSELOR2_CALENDAR_ID,
  counselor3: process.env.COUNSELOR3_CALENDAR_ID,
  counselor4: process.env.COUNSELOR4_CALENDAR_ID,
  counselor5: process.env.COUNSELOR5_CALENDAR_ID,
};

for (let key in counselors) {
  counselors[key].oauth2Client.setCredentials({
    refresh_token: counselors[key].refresh_token,
  });
}

app.post("/check-available-slots", async (req, res) => {
  try {
    console.log("Received request for check-available-slots");
    const { date, timeRange, counselor } = req.body;
    const startOfDay = new Date(date);
    startOfDay.setHours(
      timeRange === "morning" ? 9 : timeRange === "afternoon" ? 12 : 17,
      0,
      0,
      0
    );
    const endOfDay = new Date(date);
    endOfDay.setHours(
      timeRange === "morning" ? 12 : timeRange === "afternoon" ? 17 : 21,
      0,
      0,
      0
    );

    const events = await calendar.events.list({
      auth: counselors[counselor].oauth2Client,
      calendarId: counselorCalendarIDs[counselor],
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    console.log("Events: ", events.data.items);

    const bookedSlots = getBookedSlots(events.data.items);
    const availableSlots = calculateAvailableSlots(
      startOfDay,
      endOfDay,
      bookedSlots
    );
    console.log(`Counselor: ${counselor}`);
    console.log("Booked Slots: ", bookedSlots.map(formatTimeRange).join(", "));
    console.log("Available Slots: ", availableSlots.join(", "));
    res.json({
      availableSlots,
      bookedSlots: bookedSlots.map(formatTimeRange),
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ error: error.message });
  }
});

function formatTimeRange({ start, end }) {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function calculateAvailableSlots(start, end, bookedSlots) {
  const availableSlots = [];
  const currentTime = new Date(start);

  while (currentTime <= end) {
    const slotStart = new Date(currentTime);
    const slotEnd = new Date(currentTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + 30);

    const slotRangeBooked = bookedSlots.some((bookedSlot) => {
      const bookedSlotStart = new Date(bookedSlot.start);
      const bookedSlotEnd = new Date(bookedSlot.end);
      return (
        (slotStart >= bookedSlotStart && slotStart < bookedSlotEnd) ||
        (slotEnd > bookedSlotStart && slotEnd <= bookedSlotEnd)
      );
    });

    if (!slotRangeBooked) {
      availableSlots.push(formatTime(currentTime));
    }
    currentTime.setMinutes(currentTime.getMinutes() + 30);
  }

  return availableSlots;
}

function getBookedSlots(events) {
  const bookedSlots = [];

  events.forEach((event) => {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    bookedSlots.push({ start, end });
  });

  return bookedSlots;
}

function formatTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours < 10 ? "0" + hours : hours}:${
    minutes < 10 ? "0" + minutes : minutes
  }`;
}
function validateEmail(email) {
  var re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return re.test(email);
}
app.post("/book-appointment", async (req, res) => {
  try {
    const { startTime, endTime, counselor, userEmail } = req.body;
    if (!validateEmail(userEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    // Event creation for Google Calendar
    const event = {
      summary: "Appointment",
      start: {
        dateTime: startTime,
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: endTime,
        timeZone: "Asia/Kolkata",
      },
    };

    const eventResponse = await calendar.events.insert({
      auth: counselors[counselor].oauth2Client,
      calendarId: counselorCalendarIDs[counselor],
      resource: event,
    });

    const eventStart = new Date(eventResponse.data.start.dateTime);
    const eventEnd = new Date(eventResponse.data.end.dateTime);

     // Generate unique Google Meet link
     const meetLink = `https://meet.google.com/${eventResponse.data.id}`;

     // Format time for email content
     const formattedStartTime = formatTime(eventStart);
     const formattedEndTime = formatTime(eventEnd);
     
     // Email sending after successful booking
     const mailOptions = {
      from: process.env.EMAIL,
      to: [userEmail, counselorEmails[counselor]],
      subject: "Appointment Confirmation",
      text: `Hello,\n\nYour appointment has been booked with the counselor from ${formattedStartTime} to ${formattedEndTime}. You can join the meeting using the following link: ${meetLink}\n\nThank you.`,
    };
     // Use the updated transporter with OAuth2 credentials to send the email
     await transporter.sendMail(mailOptions);
     console.log(`Email sent to ${userEmail} and ${counselorEmails[counselor]}`);

    res.json({ message: "Appointment booked successfully" });
  } catch (error) {
    console.error("Error booking the appointment:", error);
    res.status(500).json({ error: error.message });
}
});


app.post("/send-email", async (req, res) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL,
      to: req.body.email,
      subject: "Appointment Confirmation",
      text: "Your appointment has been confirmed.",
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Email sent successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log(tokens);
    oauth2Client.setCredentials(tokens);

    res.send("Authentication successful");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});

function getAvailableSlots(events) {
  const availableSlots = [];

  return availableSlots;
}

module.exports = app;