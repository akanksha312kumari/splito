"""
Splito — Main Flask Application
Dependencies: flask, PyJWT, werkzeug (all stdlib + pip)
"""

import os
from flask import Flask, send_from_directory, jsonify
from database import init_db
from routes.auth      import auth_bp
from routes.groups    import groups_bp
from routes.expenses  import expenses_bp
from routes.insights  import insights_bp
from routes.analytics import analytics_bp
from routes.payments  import payments_bp


def create_app():
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(__file__), '..', 'frontend', 'static'),
        template_folder=os.path.join(os.path.dirname(__file__), '..', 'frontend', 'templates'),
    )
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'splito-dev-secret-change-me')
    app.config['JWT_EXPIRATION_HOURS'] = 24

    # ── Manual CORS (no flask-cors needed) ───────────────────────────────────
    @app.after_request
    def add_cors(response):
        response.headers['Access-Control-Allow-Origin']  = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
        return response

    @app.before_request
    def handle_options():
        from flask import request
        if request.method == 'OPTIONS':
            from flask import Response
            return Response(status=204, headers={
                'Access-Control-Allow-Origin':  '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            })

    # ── Blueprints ────────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp,      url_prefix='/api/auth')
    app.register_blueprint(groups_bp,    url_prefix='/api/groups')
    app.register_blueprint(expenses_bp,  url_prefix='/api/expenses')
    app.register_blueprint(insights_bp,  url_prefix='/api/insights')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(payments_bp,  url_prefix='/api/payments')

    # ── Frontend SPA catch-all ────────────────────────────────────────────────
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        static_dir = app.static_folder
        if path and os.path.exists(os.path.join(static_dir, path)):
            return send_from_directory(static_dir, path)
        return send_from_directory(app.template_folder, 'index.html')

    # ── Health check ──────────────────────────────────────────────────────────
    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok', 'app': 'Splito'})

    # ── Init DB ───────────────────────────────────────────────────────────────
    init_db()

    return app


if __name__ == '__main__':
    app = create_app()
    print("\n🚀  Splito running → http://localhost:5000\n")
    app.run(debug=True, port=5000)
