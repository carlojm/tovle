const Dateline = () => {
	const today = new Date();
	const year = today.getFullYear();
	// getMonth() is zero-based, so add 1 for real month numbers. january is 0
	const month = today.getMonth() + 1; 
	const date = today.getDate();

	const formattedDate = `${month}/${date}/${year}`;

	return (
		<div>
			<p style={{fontStyle: 'italic'}}>Today's cache, {formattedDate}:</p>
		</div>
	);
}

export default Dateline