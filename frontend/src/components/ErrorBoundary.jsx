import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary-screen">
          <img src="/images/cat-loading.png" alt="" className="error-boundary-img" />
          <h2 className="error-boundary-title">Có lỗi xảy ra 😿</h2>
          <p className="error-boundary-msg">{this.state.error.message}</p>
          <button
            className="error-boundary-btn"
            onClick={() => this.setState({ error: null })}
          >
            Thử lại
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
