import { render } from 'preact'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
import '../ui/global.css'
import { SidePanel } from './SidePanel'

const root = document.getElementById('root')
if (root) render(<SidePanel />, root)
