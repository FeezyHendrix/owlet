import { render } from 'preact'
import '../ui/global.css'
import { Onboarding } from './Onboarding'

const root = document.getElementById('root')
if (root) render(<Onboarding />, root)
