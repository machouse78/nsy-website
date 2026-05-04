import React from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import Header from './components/common/Header'
import Hero from './sections/Hero'
import About from './sections/About'
import Services from './sections/Services'
import AI from './sections/AI'
import Methods from './sections/Methods'
import Construction from './sections/Construction'
import Contact from './sections/Contact'
import Footer from './components/common/Footer'
import ScrollToTop from './components/ui/ScrollToTop'
import ChatBot from './components/ui/ChatBot'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-dark-900">
        <Header />
        <main>
          <Hero />
          <About />
          <Services />
          <AI />
          <Methods />
          <Construction />
          <Contact />
        </main>
        <Footer />
        <ScrollToTop />
        <ChatBot />
      </div>
    </Router>
  )
}

export default App