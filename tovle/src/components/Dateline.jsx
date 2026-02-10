const Dateline = () => {
	const style = {
		fontStyle: 'italic'
	}
	const today = new Date();
	const year = today.getFullYear();
	// getMonth() is zero-based, so add 1 for standard month numbers (January is 0)
	const month = today.getMonth() + 1; 
	const date = today.getDate();

	const formattedDate = `${month}/${date}/${year}`;

	return (
		<div>
		<p style={style}>For the day of {formattedDate}</p>
		</div>
	);
}

export default Dateline