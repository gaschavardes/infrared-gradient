import WebGL from '@/components/WebGL'
import styles from './styles.module.css'
export default function Page() {

	return <div>
			<section className={styles.head}>
				<WebGL/>
			</section>
			<section className={styles.middle}>
			<h1 >Infrared Gradient</h1>
			</section>
			<section className={styles.small}>
				<div className={styles.container}>
					<WebGL/>
				</div>
			</section>
			<section className={styles.footer}>
				<WebGL/>
			</section>
		</div>
  }