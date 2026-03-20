const Info = () => {
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
			<p>{formattedDate}</p>

            <p>WIP</p>
            <p>I am building Tovle as a way to learn React and CSS!</p>
            <p>For feedback or suggestions message me @carlojm on Discord.</p>
		</div>
	);
}

export default Info