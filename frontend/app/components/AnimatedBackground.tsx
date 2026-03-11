export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/30 mix-blend-screen filter blur-[100px] animate-pulse" />
      <div
        className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/30 mix-blend-screen filter blur-[120px] animate-pulse"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-pink-600/20 mix-blend-screen filter blur-[130px] animate-pulse"
        style={{ animationDelay: "4s" }}
      />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
    </div>
  );
}
