const Caches = () => {
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
            <p>Cache opening coming soon</p>
		</div>
	);
}

export default Caches