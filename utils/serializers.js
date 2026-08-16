export function publicUser(user) {
  if (!user) return null;
  const source = user.toObject ? user.toObject() : { ...user };
  const { password, verificationToken, resetPasswordToken, resetPasswordExpires, ...safe } = source;
  return safe;
}

export function publicItem(item, options = {}) {
  const source = item.toObject ? item.toObject() : { ...item };
  delete source.privateDetails;
  delete source.uniqueMarks;
  if (source.verificationQuestions) {
    source.verificationQuestions = source.verificationQuestions.map(({ question, _id }) => ({ question, _id }));
  }
  if (source.privacy?.hideExactLocation) {
    delete source.building;
    delete source.floor;
    delete source.room;
    delete source.landmark;
  }
  if (!options.includeReporterContact && source.reporter) {
    const reporter = source.reporter.toObject ? source.reporter.toObject() : source.reporter;
    source.reporter = source.privacy?.hideReporter
      ? { name: 'Campus member', role: reporter?.role, anonymous: true }
      : reporter
      ? { _id: reporter._id, name: reporter.name, profileImage: reporter.profileImage, role: reporter.role }
      : reporter;
  }
  return source;
}
