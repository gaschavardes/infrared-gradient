'use client'
import styles from './styles.module.css'
import WebGL from '@/components/WebGL'
import List from '@/components/List'
import { useEffect } from "react"


export default function About() {
	const data = {
		list: [
			{
				title: 'coucou card 1',
				id: 1
			},
			{
				title: 'coucou',
				id: 2
			},
			{
				title: 'coucou',
				id: 3
			},
			{
				title: 'coucou',
				id: 4
			},
			{
				title: 'coucou',
				id: 5
			}
		]
	}
	return <div>
			<h1  className={styles.title}>about Hello, Next.js!</h1>
			<List data={data.list}/>
			<WebGL/>
		</div>
  }