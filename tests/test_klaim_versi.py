import os
import unittest

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123:abc")


class KlaimVersiTest(unittest.TestCase):
    def test_pin_dibersihkan(self):
        from cekas_app.bot import _clean_pin
        for args in (["280709"], ["<280709>"], ["PIN", "280709"], ['"280709"'], ["pin:", "[280709]"]):
            self.assertEqual(_clean_pin(args), "280709")

    def test_versi(self):
        from cekas_app import version
        info = version.info()
        self.assertEqual(info["app"], "CEKAS")
        self.assertRegex(info["version"], r"^\d+\.\d+\.\d+$")


if __name__ == "__main__":
    unittest.main()
