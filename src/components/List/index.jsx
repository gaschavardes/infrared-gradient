import { useEffect } from "react"
import Card from "@/components/Card"
import styles from './styles.module.css'
export default function List({data}){
	// const content = data
	
	useEffect(() => {
		console.log(data)
	}, [data])

	return <div>
		<pre>{data[0].title}</pre>
		<ul>
			{data.map((name) => (
				<Card data={name} key={name.id} />
			))}
		</ul>
	</div>
}