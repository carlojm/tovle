import { useState, useEffect } from "react";
import { getMsUntilMidnightEastern } from "../utils/dates";

const formatTimeLeft = (ms) => {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":")
}

const DayTimer = () => {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(getMsUntilMidnightEastern()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(formatTimeLeft(getMsUntilMidnightEastern()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p style={{ opacity: 0.7, fontSize: "0.85rem" }}>
      Caches wash away in: <strong>{timeLeft}</strong>
    </p>
  );
}

export default DayTimer