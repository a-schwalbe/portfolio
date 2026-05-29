import './App.css'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import Layout from './components/Layout.jsx'
import SicilianLessonPage from './pages/SicilianLessonPage.jsx';
import LondonLessonPage from './pages/LondonLessonPage.jsx';
import PracticePage from './pages/PracticePage.jsx';
import QuizPage from './pages/QuizPage.jsx';




function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route path="sicilian" element={<SicilianLessonPage/>}/>
        <Route path="london" element={<LondonLessonPage/>}/>
        <Route path="practice" element={<PracticePage/>}/>
        <Route path="quiz" element={<QuizPage/>}/>

      </Route>
    </Routes>
  )
}

export default App
