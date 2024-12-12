import { useEffect } from "react"
import styles from './styles.module.css'
export default function Card({data}){
	useEffect(() => {
		console.log(data)
	}, [])
	return <li>
		<h2>{data.title}</h2>
		<span>{data.id}</span>
	</li>
}