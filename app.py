import os
import numpy as np
from flask import Flask, render_template, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, decode_token
)
from werkzeug.security import generate_password_hash, check_password_hash

from config import Config
from extensions import db, jwt
import models


def create_app(config_class=Config):
    # Determine the absolute path to project directory to prevent static resolution issues
    base_dir = os.path.abspath(os.path.dirname(__file__))
    
    app = Flask(
        __name__,
        static_folder=os.path.join(base_dir, 'static'),
        static_url_path='/static'
    )
    app.config.from_object(config_class)

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)

    # =========================================================================
    # Helper Utilities
    # =========================================================================
    def get_optional_user_id():
        """
        Extracts user_id from optional Bearer JWT token if provided in headers.
        Returns None if no valid token exists.
        """
        auth_header = request.headers.get("Authorization", None)
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        token = auth_header.split(" ")[1]
        try:
            decoded = decode_token(token)
            return int(decoded.get("sub"))
        except Exception:
            return None

    def calculate_match_score(user_skills, course_skills):
        """
        Calculates a match percentage based on overlapping user skills
        and course requirements.
        """
        if not course_skills:
            return 0.0

        user_skill_ids = {us.skill_id for us in user_skills}
        course_skill_ids = {cs.skill_id for cs in course_skills}

        if not course_skill_ids:
            return 0.0

        overlap = user_skill_ids.intersection(course_skill_ids)
        score = (len(overlap) / len(course_skill_ids)) * 100.0
        return round(score, 2)

    def generate_recommendation_explanation(user_skill_names, course):
        """
        Generates a human-readable explanation for why a course was recommended.
        """
        course_skill_names = [
            cs.skill.name for cs in getattr(course, 'course_skills', []) if cs.skill
        ]

        matched_skills = list(set(user_skill_names).intersection(set(course_skill_names)))
        missing_skills = list(set(course_skill_names) - set(user_skill_names))

        if matched_skills and missing_skills:
            return f"Matches your expertise in {', '.join(matched_skills)} and helps you learn {', '.join(missing_skills)}."
        elif matched_skills:
            return f"Strongly aligns with your current skills in {', '.join(matched_skills)}."
        elif missing_skills:
            return f"Great choice to expand your skill set into {', '.join(missing_skills)}."
        else:
            return "Recommended based on overall career trajectory and profile analysis."

    def cosine_similarity(vec_a, vec_b):
        """Calculates cosine similarity between two numeric vectors."""
        a = np.array(vec_a, dtype=float)
        b = np.array(vec_b, dtype=float)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def format_course_dict(course, user=None):
        """Formats a Course object into a dictionary payload."""
        course_skills = [
            {
                "skill_id": cs.skill.id,
                "name": cs.skill.name,
                "description": cs.skill.description,
                "level_required": getattr(cs, 'level_required', None)
            }
            for cs in getattr(course, 'course_skills', []) if cs.skill
        ]

        data = {
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "instructor": course.instructor,
            "created_at": course.created_at.isoformat() if hasattr(course, 'created_at') and course.created_at else None,
            "skills": course_skills,
        }

        # Calculate personalized match score if user is logged in
        if user:
            data["match_score"] = calculate_match_score(user.user_skills, course.course_skills)
        else:
            data["match_score"] = None

        return data

    # =========================================================================
    # HTML View Routes
    # =========================================================================
    @app.route('/')
    @app.route('/login')
    def login_page():
        return render_template('login.html')

    @app.route('/register')
    def register_page():
        return render_template('register.html')

    @app.route('/courses')
    def courses_page():
        return render_template('courses.html')

    @app.route('/analyze')
    def analyze_page():
        return render_template('analyze.html')

    @app.route('/history')
    def history_page():
        return render_template('history.html')

    @app.route('/profile')
    def profile_page():
        return render_template('profile.html')

    # =========================================================================
    # API Routes: Skills Autocomplete
    # =========================================================================
    @app.route('/api/skills', methods=['GET'])
    def get_skills():
        search_q = request.args.get('q', '', type=str).strip()
        query = models.Skill.query

        if search_q:
            query = query.filter(models.Skill.name.ilike(f"%{search_q}%"))

        skills = query.limit(20).all()
        return jsonify([
            {
                "id": skill.id,
                "name": skill.name,
                "description": skill.description
            }
            for skill in skills
        ]), 200

    # =========================================================================
    # API Routes: Course Discovery & Search
    # =========================================================================

    # -------------------------------------------------------------------------
    # 1. GET /api/courses
    # -------------------------------------------------------------------------
    @app.route('/api/courses', methods=['GET'])
    def get_courses():
        search_q = request.args.get('q', '', type=str).strip()
        skill_filter = request.args.get('skill', '', type=str).strip()
        instructor_filter = request.args.get('instructor', '', type=str).strip()
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        sort_by = request.args.get('sort', 'relevance', type=str).strip().lower()

        page = max(1, page)
        limit = min(max(1, limit), 100)

        query = models.Course.query

        if search_q:
            search_pattern = f"%{search_q}%"
            query = query.filter(
                (models.Course.title.ilike(search_pattern)) |
                (models.Course.description.ilike(search_pattern)) |
                (models.Course.instructor.ilike(search_pattern))
            )

        if instructor_filter:
            query = query.filter(models.Course.instructor.ilike(f"%{instructor_filter}%"))

        if skill_filter:
            query = query.join(models.CourseSkill).join(models.Skill).filter(
                models.Skill.name.ilike(f"%{skill_filter}%")
            )

        if sort_by in ['title_asc', 'title']:
            query = query.order_by(models.Course.title.asc())
        elif sort_by == 'title_desc':
            query = query.order_by(models.Course.title.desc())
        elif sort_by == 'newest' and hasattr(models.Course, 'created_at'):
            query = query.order_by(models.Course.created_at.desc())
        elif sort_by == 'oldest' and hasattr(models.Course, 'created_at'):
            query = query.order_by(models.Course.created_at.asc())

        current_user_id = get_optional_user_id()
        current_user = models.User.query.get(current_user_id) if current_user_id else None

        pagination = query.paginate(page=page, per_page=limit, error_out=False)
        courses = pagination.items

        course_list = [format_course_dict(c, user=current_user) for c in courses]

        if sort_by in ['relevance', 'match'] and current_user:
            course_list.sort(key=lambda x: x['match_score'] or 0, reverse=True)

        return jsonify({
            "courses": course_list,
            "pagination": {
                "page": pagination.page,
                "limit": pagination.per_page,
                "total_items": pagination.total,
                "total_pages": pagination.pages
            }
        }), 200

    # -------------------------------------------------------------------------
    # 2. GET /api/courses/<course_id>
    # -------------------------------------------------------------------------
    @app.route('/api/courses/<int:course_id>', methods=['GET'])
    def get_course_detail(course_id):
        course = models.Course.query.get(course_id)
        if not course:
            return jsonify({"error": "Course not found"}), 404

        current_user_id = get_optional_user_id()
        current_user = models.User.query.get(current_user_id) if current_user_id else None

        course_data = format_course_dict(course, user=current_user)

        other_courses = models.Course.query.filter(models.Course.id != course.id).all()
        has_embeddings = hasattr(course, 'embedding') and course.embedding is not None

        if has_embeddings:
            target_vector = course.embedding
            scored_related = []
            for other in other_courses:
                if hasattr(other, 'embedding') and other.embedding is not None:
                    sim = cosine_similarity(target_vector, other.embedding)
                    scored_related.append((sim, other))

            scored_related.sort(key=lambda x: x[0], reverse=True)
            top_related = [item[1] for item in scored_related[:5]]
        else:
            target_skill_ids = {cs.skill_id for cs in getattr(course, 'course_skills', [])}
            scored_related = []
            for other in other_courses:
                other_skill_ids = {cs.skill_id for cs in getattr(other, 'course_skills', [])}
                overlap = len(target_skill_ids.intersection(other_skill_ids))
                if overlap > 0:
                    scored_related.append((overlap, other))

            scored_related.sort(key=lambda x: x[0], reverse=True)
            top_related = [item[1] for item in scored_related[:5]]

        related_courses = [format_course_dict(rc, user=current_user) for rc in top_related]

        return jsonify({
            "course": course_data,
            "related_courses": related_courses
        }), 200

    # =========================================================================
    # API Routes: Personalized Recommendations
    # =========================================================================

    # -------------------------------------------------------------------------
    # POST /api/recommend (JWT Required)
    # -------------------------------------------------------------------------
    @app.route('/api/recommend', methods=['POST'])
    @jwt_required()
    def get_recommendations():
        """
        Accepts user profile/skills and returns a personalized course list
        with match scores and explanations.
        """
        current_user_id = get_jwt_identity()
        user = models.User.query.get(int(current_user_id))

        if not user:
            return jsonify({"error": "User profile not found"}), 404

        data = request.get_json() or {}
        limit = min(max(1, data.get('limit', 10)), 50)

        # Retrieve user skill profile (supporting optional request overrides)
        override_skills = data.get('skills', None)

        if override_skills is not None and isinstance(override_skills, list):
            user_skill_names = [s.get('name') for s in override_skills if isinstance(s, dict) and 'name' in s]
        else:
            user_skill_names = [us.skill.name for us in user.user_skills if us.skill]

        all_courses = models.Course.query.all()
        scored_recommendations = []

        # Calculate vector similarity or skill match score for all courses
        for course in all_courses:
            match_score = calculate_match_score(user.user_skills, course.course_skills)

            # Check for embedding similarity if available
            if hasattr(user, 'embedding') and hasattr(course, 'embedding'):
                if user.embedding and course.embedding:
                    sim = cosine_similarity(user.embedding, course.embedding)
                    match_score = round(sim * 100.0, 2)

            explanation = generate_recommendation_explanation(user_skill_names, course)

            course_payload = format_course_dict(course, user=user)
            course_payload["match_score"] = match_score
            course_payload["explanation"] = explanation

            scored_recommendations.append(course_payload)

        # Sort recommendations by match_score descending
        scored_recommendations.sort(key=lambda x: x["match_score"], reverse=True)
        top_recommendations = scored_recommendations[:limit]

        return jsonify({
            "user_id": user.id,
            "skills_analyzed": user_skill_names,
            "recommendations": top_recommendations
        }), 200

    # =========================================================================
    # API Routes: Authentication & User Profile
    # =========================================================================

    # -------------------------------------------------------------------------
    # 1. POST /api/auth/register
    # -------------------------------------------------------------------------
    @app.route('/api/auth/register', methods=['POST'])
    def register():
        data = request.get_json() or {}

        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not username or not email or not password:
            return jsonify({'error': 'Username, email, and password are required.'}), 400

        if models.User.query.filter_by(email=email).first():
            return jsonify({'error': 'User with this email already exists.'}), 400

        if models.User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username is already taken.'}), 400

        hashed_password = generate_password_hash(password)
        new_user = models.User(
            username=username,
            email=email,
            password=hashed_password,
            phone=data.get('phone'),
            age=data.get('age'),
            major=data.get('major')
        )

        db.session.add(new_user)
        db.session.flush()

        skills_data = data.get('skills', [])
        for item in skills_data:
            skill_id = item.get('skill_id')
            proficiency = item.get('proficiency_level', 'beginner')

            skill = models.Skill.query.get(skill_id)
            if skill:
                user_skill = models.UserSkill(
                    user_id=new_user.id,
                    skill_id=skill.id,
                    proficiency_level=proficiency
                )
                db.session.add(user_skill)

        db.session.commit()

        token = create_access_token(identity=str(new_user.id))

        return jsonify({
            'user': {
                'id': new_user.id,
                'username': new_user.username,
                'email': new_user.email
            },
            'token': token
        }), 201

    # -------------------------------------------------------------------------
    # 2. POST /api/auth/login
    # -------------------------------------------------------------------------
    @app.route('/api/auth/login', methods=['POST'])
    def login():
        data = request.get_json() or {}

        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password are required.'}), 400

        user = models.User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password, password):
            return jsonify({'error': 'Invalid email or password.'}), 401

        token = create_access_token(identity=str(user.id))

        return jsonify({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            },
            'token': token
        }), 200

    # -------------------------------------------------------------------------
    # 3. GET /api/users/me (JWT Protected)
    # -------------------------------------------------------------------------
    @app.route('/api/users/me', methods=['GET'])
    @jwt_required()
    def get_current_user_profile():
        current_user_id = get_jwt_identity()
        user = models.User.query.get(int(current_user_id))

        if not user:
            return jsonify({'error': 'User not found.'}), 404

        user_skills_list = []
        for us in user.user_skills:
            user_skills_list.append({
                'skill_id': us.skill.id,
                'name': us.skill.name,
                'description': us.skill.description,
                'proficiency_level': us.proficiency_level
            })

        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'phone': user.phone,
            'age': user.age,
            'major': user.major,
            'skills': user_skills_list,
            'created_at': user.created_at.isoformat(),
            'updated_at': user.updated_at.isoformat()
        }), 200

    # =========================================================================
    # Graceful Error Handlers
    # =========================================================================
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)