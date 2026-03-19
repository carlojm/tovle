const Dateline = ({dailyCaches}) => {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth() + 1; 
	const date = today.getDate();

	const formattedDate = `${month}/${date}/${year}`;

	return (
		<div>
		{/* <p style={{fontStyle: 'italic'}}>Today's caches: {formattedDate}</p> */}
		<p>{formattedDate}</p>
		{dailyCaches.map((cache) => (
			<p key={cache.id}> <strong>#{cache.id}</strong> {cache.coordinates.x}, {cache.coordinates.z}</p>
		))}
		</div>
	);
}

export default Dateline