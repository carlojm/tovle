import { useState, useEffect } from "react";
const Dateline = () => {
	
	const formattedDate = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		month: 'numeric', day: 'numeric', year: 'numeric',
	}).format(new Date());

	const getTimeUntilMidnight = () => {
		const now = new Date();

		// Get current time in ET as a string, then parse it back
		// to find what "today" is in ET
		const etFormatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'America/New_York',
			year: 'numeric', month: '2-digit', day: '2-digit',
		});
		const etDateStr = etFormatter.format(now); // "YYYY-MM-DD"
		
		// Construct midnight ET by treating that date string as ET midnight
		const [y, mo, d] = etDateStr.split('-').map(Number);
		const etMidnight = new Date(
			Date.UTC(y, mo - 1, d + 1, 5, 0, 0) // ET midnight = UTC+5 in standard, UTC+4 in daylight
		);

		// Adjust for daylight saving: check if ET is currently UTC-4 or UTC-5
		const etOffsetStr = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			timeZoneName: 'shortOffset',
		}).formatToParts(now).find(p => p.type === 'timeZoneName').value;
		const isDST = etOffsetStr === 'GMT-4';
		const utcOffsetHours = isDST ? 4 : 5;

		const etMidnightUTC = new Date(Date.UTC(y, mo - 1, d + 1, utcOffsetHours, 0, 0));

		const diff = etMidnightUTC - now;
		const h = Math.floor(diff / 1000 / 60 / 60);
		const m = Math.floor((diff / 1000 / 60) % 60);
		const s = Math.floor((diff / 1000) % 60);
		return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
	};

	const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, []);


	return (
		<div style={{
			display:'flex',
			flexDirection: 'column',
			alignItems: 'center',
			marginBottom: '16px'
		}}>
			<p><strong>Welcome to Tovle!</strong></p>
			{/* <p style={{fontStyle: 'italic'}}>Today's caches: {formattedDate}</p> */}
			<p style={{marginBottom: "8px"}}>{formattedDate}</p>
      <p>Pinpoint four cache locations on the map.</p>
			<p>Guess within 50 blocks to find the cache.</p>
			<p style={{ marginTop: "8px", opacity: 0.7, fontSize: "0.85rem" }}>
        Caches wash away in: <strong>{timeLeft}</strong>
      </p>
		</div>
	);
}

export default Dateline