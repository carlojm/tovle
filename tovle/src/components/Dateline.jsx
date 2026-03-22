const Dateline = () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth() + 1; 
	const date = today.getDate();
	const formattedDate = `${month}/${date}/${year}`;



	return (
		<div style={{
			display:'flex',
			flexDirection: 'column',
			alignItems: 'center'
		}}>
			<p><strong>Welcome to Tovle! WIP</strong></p>
			{/* <p style={{fontStyle: 'italic'}}>Today's caches: {formattedDate}</p> */}
			<p style={{marginBottom: "8px"}}>{formattedDate}</p>
      <p>Pinpoint this cache's location on the map.</p>
			<p>Guess within 50 blocks to find the cache.</p>
		</div>
	);
}

export default Dateline