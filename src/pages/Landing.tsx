import { Link } from 'react-router-dom'
import './Landing.css'

interface Project {
  title: string
  description: string
  tags: string[]
  href: string
  external?: boolean
  status: 'live' | 'coming-soon'
}

const PROJECTS: Project[] = [
  {
    title: 'Two-Point % Explorer',
    description:
      'Who shot the highest two-point field goal percentage in a single season? Explore records across the modern era, filtered by position and season.',
    tags: ['Shooting', 'Records', 'All Seasons'],
    href: '/two-point-percentage',
    status: 'live',
  },
  {
    title: 'Season Trajectories',
    description:
      "How do the greatest NBA seasons compare game-by-game? Chart legendary teams' win trajectories and forecast how current seasons might finish.",
    tags: ['Team Stats', 'Win %', 'Forecasting'],
    href: '/season-trajectories/',
    external: false,
    status: 'live',
  },
]

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <h1 className="landing-title">NBA Curios</h1>
        <p className="landing-subtitle">Statistical deep-dives into basketball history</p>
      </header>

      <main className="landing-main">
        <div className="project-grid">
          {PROJECTS.map((project) => (
            <ProjectCard key={project.title} project={project} />
          ))}
        </div>
      </main>

      <footer className="landing-footer">
        <p>Data via <span className="muted">nba_api</span> · Stats.nba.com</p>
      </footer>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const inner = (
    <div className={`project-card ${project.status === 'coming-soon' ? 'project-card--dim' : ''}`}>
      <div className="project-card-top">
        <h2 className="project-card-title">{project.title}</h2>
        {project.status === 'coming-soon' && (
          <span className="badge badge--soon">Soon</span>
        )}
      </div>
      <p className="project-card-desc">{project.description}</p>
      <div className="project-card-footer">
        <div className="project-tags">
          {project.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        {project.status === 'live' && (
          <span className="project-card-cta">Explore →</span>
        )}
      </div>
    </div>
  )

  if (project.status === 'coming-soon') return inner

  if (project.external) {
    return <a href={project.href} className="project-card-link">{inner}</a>
  }

  return <Link to={project.href} className="project-card-link">{inner}</Link>
}
