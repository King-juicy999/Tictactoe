"""
Django API Views for Behavior Analysis
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .ai_models import BehaviorAnalyzer, PlayerBehaviorProfile, MoveEvent, PatternAnalysis


@csrf_exempt
@require_http_methods(["POST"])
def record_game(request):
    """Record a completed game"""
    try:
        data = json.loads(request.body)
        player_name = data.get('playerName')
        game_data = {
            'result': data.get('result'),
            'moves': data.get('moves', []),
            'duration': data.get('duration', 0),
            'patterns': data.get('patterns', {})
        }
        
        profile = BehaviorAnalyzer.update_profile(player_name, game_data)
        
        return JsonResponse({
            'ok': True,
            'message': 'Game recorded',
            'profile': {
                'wins': profile.wins,
                'losses': profile.losses,
                'totalGames': profile.total_games,
                'exploitabilityScore': profile.exploitability_score
            }
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET"])
def get_profile(request, player_name):
    """Get player behavior profile"""
    try:
        profile = PlayerBehaviorProfile.objects.get(player_name=player_name)
        
        return JsonResponse({
            'ok': True,
            'profile': {
                'playerName': profile.player_name,
                'totalGames': profile.total_games,
                'wins': profile.wins,
                'losses': profile.losses,
                'draws': profile.draws,
                'strategyType': profile.strategy_type,
                'averageResponseTime': profile.average_response_time,
                'exploitabilityScore': profile.exploitability_score,
                'preferredOpenings': profile.preferred_openings[-10:],  # Last 10
                'lastGameAt': profile.last_game_at.isoformat() if profile.last_game_at else None
            }
        })
    except PlayerBehaviorProfile.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Profile not found'}, status=404)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def predict_move(request):
    """Predict player's next move"""
    try:
        data = json.loads(request.body)
        player_name = data.get('playerName')
        current_board = data.get('boardState', [])
        move_history = data.get('moveHistory', [])
        
        predicted_move = BehaviorAnalyzer.predict_next_move(
            player_name, current_board, move_history
        )
        
        return JsonResponse({
            'ok': True,
            'predictedMove': predicted_move
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET"])
def get_difficulty(request, player_name):
    """Get adaptive difficulty for player"""
    try:
        difficulty = BehaviorAnalyzer.calculate_difficulty(player_name)
        
        return JsonResponse({
            'ok': True,
            'difficulty': difficulty,
            'level': 'easy' if difficulty < 0.4 else 'hard' if difficulty > 0.6 else 'medium'
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def check_anomalies(request):
    """Check for suspicious behavior"""
    try:
        data = json.loads(request.body)
        player_name = data.get('playerName')
        current_move = data.get('move', {})
        
        anomalies = BehaviorAnalyzer.detect_anomalies(player_name, current_move)
        
        return JsonResponse({
            'ok': True,
            'anomalies': anomalies,
            'flagged': len(anomalies) > 0
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET"])
def leaderboard(request):
    """Get leaderboard of players by wins"""
    try:
        profiles = PlayerBehaviorProfile.objects.filter(
            total_games__gte=1
        ).order_by('-wins', 'losses')[:50]
        
        leaderboard_data = [
            {
                'playerName': p.player_name,
                'wins': p.wins,
                'losses': p.losses,
                'totalGames': p.total_games,
                'winRate': round(p.wins / max(p.total_games, 1) * 100, 1)
            }
            for p in profiles
        ]
        
        return JsonResponse({
            'ok': True,
            'leaderboard': leaderboard_data
        })
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)

