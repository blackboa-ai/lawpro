import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <h1 className="text-4xl font-bold mb-6 text-gray-900">
        Welcome to LawPro
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Your professional hearing date tracker
      </p>
      
      <div className="space-y-4">
        <Link 
          href="/login"
          className="inline-block w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="inline-block w-full border border-blue-600 text-blue-600 py-3 px-6 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Register
        </Link>
      </div>
    </div>
  )
}