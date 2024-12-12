'use client'
import { useEffect, useRef } from "react"
import styles from './styles.module.css'
import AnimatedGradient from '@/assets/js/animatedGradient'


export default function WebGLComponent({data}){
	const canvas = useRef('')
	let gradient = null
	
	useEffect(() => {
		if(!gradient){
			gradient = new AnimatedGradient(canvas.current)
		}
	}, [data])

	return <div  ref={canvas} className={[styles.canvas]}></div>
}