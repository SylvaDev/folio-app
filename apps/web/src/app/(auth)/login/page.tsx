import { Suspense } from 'react'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-forest flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-mint" />
            <span className="font-serif text-3xl font-black text-white">
              Folio<span className="text-terra">.</span>
            </span>
          </Link>
          <p className="text-cream/60 text-sm mt-2">Your reading life, finally organized.</p>
        </div>
        <Suspense
          fallback={
            <div className="bg-white rounded-3xl p-8 shadow-2xl">
              <div className="h-48 animate-pulse bg-gray-100 rounded-xl" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
