const Dateline = ({dailyCaches}) => {
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
			<p>
				(DEBUG INFO) Today's caches:
				{dailyCaches.map((cache) => (
					<> <strong>#{cache.id}</strong></>
				))}
			</p>
		</div>
	);
}

export default Dateline