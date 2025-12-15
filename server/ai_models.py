"""
AI Models for Player Behavior Analysis
Python/Django backend implementation
"""

from django.db import models
from django.utils import timezone
import json
from collections import Counter, defaultdict
import numpy as np
from typing import Dict, List, Optional, Tuple


class PlayerBehaviorProfile(models.Model):
    """Stores player behavioral profile"""
    player_name = models.CharField(max_length=255, unique=True, db_index=True)
    total_games = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    draws = models.IntegerField(default=0)
    
    # Pattern data stored as JSON
    preferred_openings = models.JSONField(default=list)  # List of first moves
    common_sequences = models.JSONField(default=dict)  # {sequence: frequency}
    average_response_time = models.FloatField(default=0.0)
    strategy_type = models.CharField(
        max_length=20,
        choices=[
            ('aggressive', 'Aggressive'),
            ('defensive', 'Defensive'),
            ('balanced', 'Balanced')
        ],
        default='balanced'
    )
    
    # Behavioral embedding (vector representation)
    behavioral_embedding = models.JSONField(default=list)  # List of floats
    
    # Exploitability metrics
    exploitability_score = models.FloatField(default=0.0)  # 0-100, higher = more exploitable
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    last_game_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'player_behavior_profiles'
        indexes = [
            models.Index(fields=['player_name']),
            models.Index(fields=['last_updated']),
        ]
    
    def __str__(self):
        return f"{self.player_name} ({self.total_games} games, {self.wins}W/{self.losses}L)"


class MoveEvent(models.Model):
    """Individual move event for analysis"""
    game_id = models.CharField(max_length=255, db_index=True)
    player = models.ForeignKey(PlayerBehaviorProfile, on_delete=models.CASCADE, related_name='moves')
    move_index = models.IntegerField()  # 0-8
    board_state = models.JSONField()  # Board state before move
    timestamp = models.IntegerField()  # ms since game start
    response_time = models.IntegerField()  # ms since last move
    game_phase = models.CharField(max_length=20, choices=[
        ('opening', 'Opening'),
        ('midgame', 'Midgame'),
        ('endgame', 'Endgame')
    ])
    move_type = models.CharField(max_length=20, choices=[
        ('offensive', 'Offensive'),
        ('defensive', 'Defensive'),
        ('neutral', 'Neutral')
    ])
    move_number = models.IntegerField()
    result = models.CharField(max_length=20, choices=[
        ('win', 'Win'),
        ('loss', 'Loss'),
        ('draw', 'Draw'),
        ('ongoing', 'Ongoing')
    ], default='ongoing')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'move_events'
        indexes = [
            models.Index(fields=['game_id']),
            models.Index(fields=['player', 'created_at']),
        ]


class PatternAnalysis(models.Model):
    """Stored pattern analysis results"""
    player = models.OneToOneField(PlayerBehaviorProfile, on_delete=models.CASCADE)
    markov_chain = models.JSONField(default=dict)  # Transition probabilities
    move_probabilities = models.JSONField(default=dict)  # Position probabilities
    anomaly_flags = models.JSONField(default=list)  # List of flagged anomalies
    last_analyzed = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'pattern_analyses'


class BehaviorAnalyzer:
    """Main behavior analysis engine"""
    
    @staticmethod
    def update_profile(player_name: str, game_data: Dict) -> PlayerBehaviorProfile:
        """Update player profile with new game data"""
        profile, created = PlayerBehaviorProfile.objects.get_or_create(
            player_name=player_name
        )
        
        # Update game counts
        profile.total_games += 1
        if game_data['result'] == 'win':
            profile.wins += 1
        elif game_data['result'] == 'loss':
            profile.losses += 1
        else:
            profile.draws += 1
        
        # Update patterns
        moves = game_data.get('moves', [])
        if moves:
            BehaviorAnalyzer._update_patterns(profile, moves)
            BehaviorAnalyzer._update_strategy_type(profile, moves)
            BehaviorAnalyzer._update_embedding(profile, moves)
            BehaviorAnalyzer._calculate_exploitability(profile)
        
        profile.last_game_at = timezone.now()
        profile.save()
        
        return profile
    
    @staticmethod
    def _update_patterns(profile: PlayerBehaviorProfile, moves: List[Dict]):
        """Update move patterns"""
        # Preferred openings
        first_moves = [m['moveIndex'] for m in moves if m.get('moveNumber') == 1]
        if first_moves:
            profile.preferred_openings.extend(first_moves)
            # Keep last 50
            profile.preferred_openings = profile.preferred_openings[-50:]
        
        # Common sequences
        sequences = BehaviorAnalyzer._extract_sequences(moves)
        current_sequences = profile.common_sequences or {}
        for seq, count in sequences.items():
            current_sequences[seq] = current_sequences.get(seq, 0) + count
        profile.common_sequences = current_sequences
        
        # Average response time
        response_times = [m['responseTime'] for m in moves if m.get('responseTime', 0) > 0]
        if response_times:
            current_avg = profile.average_response_time
            new_avg = np.mean(response_times)
            # Weighted average
            total_games = profile.total_games
            profile.average_response_time = (current_avg * (total_games - 1) + new_avg) / total_games
    
    @staticmethod
    def _extract_sequences(moves: List[Dict], length: int = 3) -> Dict[str, int]:
        """Extract move sequences"""
        sequences = {}
        for i in range(len(moves) - length + 1):
            seq = '-'.join(str(moves[i+j]['moveIndex']) for j in range(length))
            sequences[seq] = sequences.get(seq, 0) + 1
        return sequences
    
    @staticmethod
    def _update_strategy_type(profile: PlayerBehaviorProfile, moves: List[Dict]):
        """Classify player strategy type"""
        offensive_count = sum(1 for m in moves if m.get('moveType') == 'offensive')
        defensive_count = sum(1 for m in moves if m.get('moveType') == 'defensive')
        total_moves = len(moves)
        
        if total_moves == 0:
            return
        
        offensive_ratio = offensive_count / total_moves
        defensive_ratio = defensive_count / total_moves
        
        if offensive_ratio > 0.4:
            profile.strategy_type = 'aggressive'
        elif defensive_ratio > 0.4:
            profile.strategy_type = 'defensive'
        else:
            profile.strategy_type = 'balanced'
    
    @staticmethod
    def _update_embedding(profile: PlayerBehaviorProfile, moves: List[Dict]):
        """Create/update behavioral embedding vector"""
        # Simple feature extraction
        features = [
            len(moves),  # Game length
            np.mean([m.get('responseTime', 0) for m in moves]),  # Avg response time
            len(set(m['moveIndex'] for m in moves)),  # Unique positions used
            sum(1 for m in moves if m.get('moveType') == 'offensive'),  # Offensive moves
            sum(1 for m in moves if m.get('moveType') == 'defensive'),  # Defensive moves
            moves[0]['moveIndex'] if moves else 0,  # Opening move
        ]
        
        # Normalize and combine with existing embedding
        if profile.behavioral_embedding:
            old_embedding = np.array(profile.behavioral_embedding)
            new_features = np.array(features)
            # Weighted combination
            profile.behavioral_embedding = (
                (old_embedding * 0.7 + new_features * 0.3).tolist()
            )
        else:
            profile.behavioral_embedding = features
    
    @staticmethod
    def _calculate_exploitability(profile: PlayerBehaviorProfile):
        """Calculate how exploitable/predictable the player is"""
        sequences = profile.common_sequences or {}
        if not sequences:
            profile.exploitability_score = 0.0
            return
        
        # More repetition = more exploitable
        total_sequences = sum(sequences.values())
        unique_sequences = len(sequences)
        
        if total_sequences == 0:
            profile.exploitability_score = 0.0
            return
        
        # Diversity ratio (lower = more exploitable)
        diversity = unique_sequences / total_sequences
        profile.exploitability_score = (1 - diversity) * 100
    
    @staticmethod
    def predict_next_move(player_name: str, current_board: List[str], 
                         move_history: List[int]) -> Optional[int]:
        """Predict player's next move using Markov chain"""
        try:
            profile = PlayerBehaviorProfile.objects.get(player_name=player_name)
        except PlayerBehaviorProfile.DoesNotExist:
            return None
        
        # Get or create pattern analysis
        pattern_analysis, _ = PatternAnalysis.objects.get_or_create(player=profile)
        
        # Build Markov chain if not exists
        if not pattern_analysis.markov_chain:
            BehaviorAnalyzer._build_markov_chain(pattern_analysis, profile)
        
        # Predict based on recent moves
        if len(move_history) >= 2:
            last_two = '-'.join(map(str, move_history[-2:]))
            transitions = pattern_analysis.markov_chain.get(last_two, {})
            
            if transitions:
                # Get most likely next move
                next_move = max(transitions.items(), key=lambda x: x[1])
                move_index = int(next_move[0])
                
                # Check if move is valid
                if current_board[move_index] == '':
                    return move_index
        
        # Fallback: use preferred openings or common patterns
        if move_history:
            # Check preferred openings
            openings = profile.preferred_openings[-10:]  # Last 10
            if openings:
                most_common = Counter(openings).most_common(1)[0][0]
                if current_board[most_common] == '':
                    return most_common
        
        return None
    
    @staticmethod
    def _build_markov_chain(pattern_analysis: PatternAnalysis, 
                           profile: PlayerBehaviorProfile):
        """Build Markov chain transition probabilities"""
        moves = MoveEvent.objects.filter(player=profile).order_by('created_at')
        
        transitions = defaultdict(lambda: defaultdict(int))
        
        for move in moves:
            if move.move_number > 1:
                # Get previous moves in same game
                prev_moves = MoveEvent.objects.filter(
                    game_id=move.game_id,
                    move_number__lt=move.move_number
                ).order_by('move_number')
                
                if len(prev_moves) >= 2:
                    sequence = '-'.join(str(m.move_index) for m in prev_moves[-2:])
                    transitions[sequence][str(move.move_index)] += 1
        
        # Convert to probabilities
        markov_chain = {}
        for seq, next_moves in transitions.items():
            total = sum(next_moves.values())
            markov_chain[seq] = {
                move: count / total 
                for move, count in next_moves.items()
            }
        
        pattern_analysis.markov_chain = markov_chain
        pattern_analysis.save()
    
    @staticmethod
    def calculate_difficulty(player_name: str) -> float:
        """Calculate adaptive difficulty (0.0 = easy, 1.0 = hard)"""
        try:
            profile = PlayerBehaviorProfile.objects.get(player_name=player_name)
        except PlayerBehaviorProfile.DoesNotExist:
            return 0.5  # Default medium
        
        # Base difficulty on win rate and exploitability
        win_rate = profile.wins / max(profile.total_games, 1)
        exploitability = profile.exploitability_score / 100
        
        # Higher win rate + lower exploitability = harder difficulty
        difficulty = (win_rate * 0.6) + ((1 - exploitability) * 0.4)
        
        return min(max(difficulty, 0.0), 1.0)
    
    @staticmethod
    def detect_anomalies(player_name: str, current_move: Dict) -> List[str]:
        """Detect suspicious behavior patterns"""
        anomalies = []
        
        try:
            profile = PlayerBehaviorProfile.objects.get(player_name=player_name)
        except PlayerBehaviorProfile.DoesNotExist:
            return anomalies
        
        # Check response time (too fast = bot-like)
        if current_move.get('responseTime', 0) < 50:  # Less than 50ms
            anomalies.append('unusually_fast_response')
        
        # Check for perfect play (always optimal moves)
        if profile.total_games > 10:
            win_rate = profile.wins / profile.total_games
            if win_rate > 0.95:
                anomalies.append('suspicious_win_rate')
        
        # Check for consistent timing (bot-like)
        moves = MoveEvent.objects.filter(player=profile).order_by('-created_at')[:20]
        if len(moves) >= 10:
            response_times = [m.response_time for m in moves if m.response_time > 0]
            if len(response_times) >= 10:
                std_dev = np.std(response_times)
                if std_dev < 50:  # Very consistent timing
                    anomalies.append('consistent_timing')
        
        return anomalies

