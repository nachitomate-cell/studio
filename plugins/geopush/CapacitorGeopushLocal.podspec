require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'CapacitorGeopushLocal'
  s.version = package['version']
  s.summary = package['description']
  s.license = 'Proprietary'
  s.homepage = 'https://synaptechspa.cl'
  s.author = package['author']
  s.source = { :git => 'https://github.com/nachitomate-cell/studio.git', :tag => package['version'] }
  s.source_files = 'ios/Sources/**/*.{swift,h,m}'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.frameworks = 'CoreLocation', 'UserNotifications'
  s.swift_version = '5.1'
end
