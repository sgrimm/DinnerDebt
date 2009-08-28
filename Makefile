#
# DinnerDebt packaging and launch commands.
#
app_id=com.midwinter.dinnerdebt

bin_dir=/opt/PalmSDK/Current/bin
package=$(bin_dir)/palm-package
launch=$(bin_dir)/palm-launch
install=$(bin_dir)/palm-install

default: run

package:
	$(package) .

install: package
	#$(launch) -c $(app_id)
	$(install) -d tcp $(app_id)*.ipk

run: install
	$(launch) -d tcp -i $(app_id)

reinstall:
	$(install) -d tcp -r $(app_id)
	$(MAKE) install

phone: package
	$(install) -d usb $(app_id)*.ipk
	$(launch) -d usb $(app_id)
