package fr.fcregny.widget;

final class WidgetPayload {
  final int widgetVersion;
  final String clubName;
  final String clubFullName;
  final String clubLogoPath;
  final String seasonTeam;
  final String seasonDivision;
  final Standing standing;
  final MatchCard lastMatch;
  final MatchCard nextMatch;

  WidgetPayload(
    int widgetVersion,
    String clubName,
    String clubFullName,
    String clubLogoPath,
    String seasonTeam,
    String seasonDivision,
    Standing standing,
    MatchCard lastMatch,
    MatchCard nextMatch
  ) {
    this.widgetVersion = widgetVersion;
    this.clubName = clubName;
    this.clubFullName = clubFullName;
    this.clubLogoPath = clubLogoPath;
    this.seasonTeam = seasonTeam;
    this.seasonDivision = seasonDivision;
    this.standing = standing;
    this.lastMatch = lastMatch;
    this.nextMatch = nextMatch;
  }

  static final class Standing {
    final Integer rank;
    final Integer points;
    final Integer played;
    final Integer goalDifference;
    final String division;
    final StandingRow[] rows;

    Standing(Integer rank, Integer points, Integer played, Integer goalDifference, String division, StandingRow[] rows) {
      this.rank = rank;
      this.points = points;
      this.played = played;
      this.goalDifference = goalDifference;
      this.division = division;
      this.rows = rows;
    }
  }

  static final class StandingRow {
    final Integer rank;
    final String team;
    final Integer points;
    final Integer played;
    final Integer goalDifference;
    final boolean tracked;

    StandingRow(Integer rank, String team, Integer points, Integer played, Integer goalDifference, boolean tracked) {
      this.rank = rank;
      this.team = team;
      this.points = points;
      this.played = played;
      this.goalDifference = goalDifference;
      this.tracked = tracked;
    }
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
