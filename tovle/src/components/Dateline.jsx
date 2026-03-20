const Dateline = ({dailyCaches, currentCacheIndex, allComplete}) => {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth() + 1; 
	const date = today.getDate();
	const formattedDate = `${month}/${date}/${year}`;

	const cacheProgress = allComplete
		? `${dailyCaches.length}/${dailyCaches.length}`
    : `${currentCacheIndex + 1}/${dailyCaches.length}`

	return (
		<div style={{
			display:'flex',
			flexDirection: 'column',
			alignItems: 'center'
		}}>
			<p><strong>Welcome to Tovle! WIP</strong></p>
			{/* <p style={{fontStyle: 'italic'}}>Today's caches: {formattedDate}</p> */}
			<p>{formattedDate}</p>
      {dailyCaches.length > 0 && (
        <p>Cache {cacheProgress}</p>
      )}
		</div>
	);
}

export default Dateline