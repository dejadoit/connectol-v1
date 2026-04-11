export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#5f5e5e] font-sans antialiased flex flex-col">
       <header className="flex h-14 items-center bg-white border-b px-6">
          <div className="font-bold text-lg tracking-tight">connectol.</div>
       </header>
       <main className="flex-1 overflow-auto">
          {children}
       </main>
    </div>
  )
}
