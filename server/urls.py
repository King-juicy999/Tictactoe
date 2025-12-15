"""
Django URL Configuration for Behavior Analysis API
"""

from django.urls import path
from .api import views

urlpatterns = [
    path('api/behavior/record-game', views.record_game, name='record_game'),
    path('api/behavior/profile/<str:player_name>', views.get_profile, name='get_profile'),
    path('api/behavior/predict-move', views.predict_move, name='predict_move'),
    path('api/behavior/difficulty/<str:player_name>', views.get_difficulty, name='get_difficulty'),
    path('api/behavior/check-anomalies', views.check_anomalies, name='check_anomalies'),
    path('api/behavior/leaderboard', views.leaderboard, name='leaderboard'),
]

