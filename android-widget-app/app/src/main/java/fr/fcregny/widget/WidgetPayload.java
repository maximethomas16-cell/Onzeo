package fr.fcregny.widget;

final class WidgetPayload {
  final int widgetVersion;
  final String clubName;
  final String seasonTeam;
  final MatchCard lastMatch;
  final MatchCard nextMatch;

  WidgetPayload(int widgetVersion, String clubName, String seasonTeam, MatchCard lastMatch, MatchCard nextMatch) {
    this.widgetVersion = widgetVersion;
    this.clubName = clubName;
    this.seasonTeam = seasonTeam;
    this.lastMatch = lastMatch;
    this.nextMatch = nextMatch;
  }

  static final class MatchCard {
    final String title;
    final String competition;
    final String dateLabel;
    final String timeLabel;
    final String venue;
    final String scoreLine;
    final TeamInfo homeTeam;
    final TeamInfo awayTeam;
    final boolean finished;

    MatchCard(
      String title,
      String competition,
      String dateLabel,
      String timeLabel,
      String venue,
      String scoreLine,
      TeamInfo homeTeam,
      TeamInfo awayTeam,
      boolean finished
    ) {
      this.title = title;
      this.competition = competition;
      this.dateLabel = dateLabel;
      this.timeLabel = timeLabel;
      this.venue = venue;
      this.scoreLine = scoreLine;
      this.homeTeam = homeTeam;
      this.awayTeam = awayTeam;
      this.finished = finished;
    }
  }

  static final class TeamInfo {
    final String name;
    final Integer rank;

    TeamInfo(String name, Integer rank) {
      this.name = name;
      this.rank = rank;
    }
  }
}
