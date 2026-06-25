import DayTimer from "./DayTimer";
import { getPuzzleNumber, getDisplayDate } from '../utils/dates.js'

const Dateline = () => {

	return (
		<div style={{
			display:'flex',
			flexDirection: 'column',
			alignItems: 'center',
			marginBottom: '16px'
		}}>
			<p><strong>Welcome to Tovle!</strong></p>
      <p>Pinpoint four cache locations on the map.</p>
			<p style={{marginBottom: "8px"}}>Guess within 50 blocks to find the cache.</p>
			<p>{getDisplayDate()} Puzzle #{getPuzzleNumber()}</p>
			<p style={{ opacity: 0.7, fontSize: "0.85rem" }}>
				Caches wash away in: <strong><DayTimer /></strong>
			</p>
		</div>
	);
}

export default Dateline