import React, { useState, useEffect } from "react";
import {
  Widget,
  addResponseMessage,
  addUserMessage,
  renderCustomComponent,
} from "react-chat-widget";
import "react-chat-widget/lib/styles.css";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import axios from "axios";

function ChatBot() {
  const [date, setDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [stage, setStage] = useState(0);
  const [userName, setUserName] = useState("");
  const [selectedCounselor, setSelectedCounselor] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [userEmailAddress, setUserEmailAddress] = useState("");

  const counselors = [
    "counselor1",
    "counselor2",
    "counselor3",
    "counselor4",
    "counselor5",
  ];

  const counselorCalendarIDs = {
    counselor1: "calendarID1",
    counselor2: "calendarID2",
    counselor3: "calendarID3",
    counselor4: "calendarID4",
    counselor5: "calendarID5",
  };

  useEffect(() => {
    addResponseMessage("Hey! What's your name?");
  }, []);

  const handleNewUserMessage = async (newMessage) => {
    try {
      if (stage === 0) {
        setUserName(newMessage);
        setStage(1);
        addResponseMessage(
          `Welcome ${newMessage}, we have the following counselors available: ${counselors.join(
            ", "
          )}`
        );
      } else if (stage === 1) {
        if (counselors.includes(newMessage)) {
          setSelectedCounselor(newMessage);
          setStage(2);
          addResponseMessage(
            `Hello, I am ${newMessage}. When do you want to book an appointment? Morning (9-11), Afternoon (12-3), Evening (5-9)?`
          );
        } else {
          addResponseMessage(
            `Sorry, I do not recognize ${newMessage}. Please select a counselor from the list: ${counselors.join(
              ", "
            )}`
          );
        }
      } else if (stage === 2) {
        const timeRange = newMessage.toLowerCase();
        if (
          timeRange === "morning" ||
          timeRange === "afternoon" ||
          timeRange === "evening"
        ) {
          setTimeRange(timeRange);
          setStage(3);
          try {
            const response = await axios.post(
              "http://localhost:5000/check-available-slots",
              {
                date: date.toISOString(),
                timeRange,
                counselor: selectedCounselor,
                calendarID: counselorCalendarIDs[selectedCounselor],
              }
            );
            console.log(response.data.availableSlots);
            const availableSlots = response.data.availableSlots;
            console.log("Available slots:", availableSlots);
            setAvailableSlots(availableSlots);
            addResponseMessage(`Available slots: ${availableSlots.join(", ")}`);
          } catch (error) {
            console.error(error);
            addResponseMessage(
              "Sorry, I am having trouble fetching the available slots."
            );
          }
        } else {
          addResponseMessage(
            "Sorry, I do not recognize that time range. Please select Morning, Afternoon, or Evening."
          );
        }
      } else if (stage === 3) {
        const selectedTime = newMessage;
        const timeParts = selectedTime.split(":");
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);

        const startTime = new Date(date);
        startTime.setHours(hour, minute);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);

        try {
          await axios.post("http://localhost:5000/book-appointment", {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            counselor: selectedCounselor,
            calendarID: counselorCalendarIDs[selectedCounselor],
          });
          addResponseMessage("Thank you! Your appointment has been booked.");

          setStage(0);
          setUserName("");
          setSelectedCounselor("");
          setShowCalendar(false);
          setTimeRange("");
        } catch (error) {
          console.error(error);
          addResponseMessage(
            "Sorry, I am having trouble booking the appointment."
          );
        }
      }
    } catch (error) {
      console.error(error);
      addResponseMessage("Sorry, I am having trouble processing your request.");
    }
  };

  const isSlotInTimeRange = (slot, timeRange) => {
    const slotTime = parseInt(slot.split(":")[0]);
    if (timeRange === "morning" && slotTime >= 9 && slotTime <= 11) {
      return true;
    } else if (timeRange === "afternoon" && slotTime >= 12 && slotTime <= 15) {
      return true;
    } else if (timeRange === "evening" && slotTime >= 17 && slotTime <= 21) {
      return true;
    } else {
      return false;
    }
  };

  const handleCounselorSelect = (counselor) => {
    setSelectedCounselor(counselor);
    setStage(2);
    addResponseMessage(
      `Hello, I am ${counselor}. If you want guidance from me, please book an appointment.`
    );
    setShowCalendar(true);
  };

  const handleDateChange = async (newDate) => {
    try {
      setDate(newDate);
      setStage(3);
      addUserMessage(newDate.toISOString());
    } catch (error) {
      console.error(error);
      addResponseMessage("Sorry, I am having trouble booking the appointment.");
    }
  };

  function getAvailableSlots(events) {
    const availableSlots = [];
    const startOfDay = new Date();
    startOfDay.setHours(9, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(21, 0, 0, 0);
    let currentTime = new Date(startOfDay);

    events.forEach((event) => {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);

      while (currentTime < eventStart) {
        availableSlots.push(formatTime(currentTime));
        currentTime.setHours(currentTime.getHours() + 1);
      }

      currentTime = new Date(eventEnd);
    });

    while (currentTime < endOfDay) {
      availableSlots.push(formatTime(currentTime));
      currentTime.setHours(currentTime.getHours() + 1);
    }

    return availableSlots;
  }

  function formatTime(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours}:${minutes}`;
  }

  return (
    <div className="App">
      <Widget
        handleNewUserMessage={handleNewUserMessage}
        title="My Chatbot"
        subtitle="Welcome to your personal Assistant!"
      />
      {showCalendar && <Calendar onChange={handleDateChange} value={date} />}
    </div>
  );
}

export default ChatBot;
