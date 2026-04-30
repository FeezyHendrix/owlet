import { render } from 'preact'
import '../ui/global.css'
import { SidePanel } from './SidePanel'

const root = document.getElementById('root')
if (root) render(<SidePanel />, root)
