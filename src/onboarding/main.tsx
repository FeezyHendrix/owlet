import { render } from 'preact'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
import '../ui/global.css'
import { Onboarding } from './Onboarding'

const root = document.getElementById('root')
if (root) render(<Onboarding />, root)
