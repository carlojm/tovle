import { useState, useEffect } from "react";
const Dateline = () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth() + 1; 
	const date = today.getDate();
	const formattedDate = `${month}/${date}/${year}`;

	const getTimeUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;

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