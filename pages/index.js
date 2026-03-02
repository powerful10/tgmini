import Link from "next/link";

export default function Home() {
  return (
    <main className="rootHome">
      <section className="rootCard">
        <h1>StellarSiege Reward Center</h1>
        <p>This project hosts the Telegram Mini App interface.</p>
        <Link href="/tg">Open /tg</Link>
      </section>
    </main>
  );
}
