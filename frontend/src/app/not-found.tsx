import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full items-center justify-center bg-[#f8f9fa]">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4 text-[#5f5e5e]">404</h2>
        <p className="text-gray-500 mb-6">Could not find requested project or access is restricted.</p>
        <Link href="/" className="bg-[#466370] text-white px-4 py-2 rounded">
           Return to Workspace
        </Link>
      </div>
    </div>
  )
}
